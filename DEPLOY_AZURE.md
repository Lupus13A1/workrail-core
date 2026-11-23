# Deploy to Azure (App Service for Containers)

## 1. Create resources
```bash
az group create -n workrail-rg -l southeastasia
az acr create -g workrail-rg -n <acrName> --sku Basic --admin-enabled false
az appservice plan create -g workrail-rg -n workrail-plan --is-linux --sku B1
az webapp create -g workrail-rg -p workrail-plan -n <webappName> \
  --container-image-name <acrName>.azurecr.io/workrail-core:latest
# let the Web App pull from ACR with managed identity
az webapp identity assign -g workrail-rg -n <webappName>
az role assignment create --assignee <principalId> --role AcrPull \
  --scope $(az acr show -n <acrName> --query id -o tsv)
az webapp config set -g workrail-rg -n <webappName> --generic-configurations '{"acrUseManagedIdentityCreds": true}'
```

## 2. App settings (environment variables)
```bash
az webapp config appsettings set -g workrail-rg -n <webappName> --settings \
  WEBSITES_PORT=8080 PORT=8080 \
  CORS_ORIGINS=https://your-frontend.example \
  FIREBASE_DATABASE_URL=https://<project>-default-rtdb.<region>.firebasedatabase.app \
  FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... \
  FIREBASE_PRIVATE_KEY=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/firebase-private-key/)
```
- Azure has no service-account file; use the three inline `FIREBASE_*` variables.
  Store the private key in **Key Vault** (grant the Web App identity `Key Vault Secrets User`).
- Set health check path to `/api/health` (Web App → Monitoring → Health check).

## 3. CI/CD
`.github/workflows/azure-deploy.yml` builds the image, pushes to ACR and deploys on push to `main`.
Repo secrets: `AZURE_CREDENTIALS` (service principal JSON), `ACR_NAME`, `ACR_LOGIN_SERVER`, `AZURE_WEBAPP_NAME`.

## Local container test
```bash
docker build -t workrail-core .
docker run --env-file .env -p 8080:8080 workrail-core
```
