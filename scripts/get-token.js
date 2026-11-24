const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const API_KEY = 'AIzaSyCd8RjLgLpr64usFe9S346SHL7tFYiOmhk';

async function main() {
  const app = initializeApp({ credential: cert('./serviceAccount.json') });
  const auth = getAuth(app);

  let targetUid = process.argv[2];

  if (!targetUid) {
    const list = await auth.listUsers(1);
    if (list.users.length > 0) {
      targetUid = list.users[0].uid;
      console.log(`Using existing user: ${list.users[0].email || targetUid} (UID: ${targetUid})`);
    } else {
      const newUser = await auth.createUser({
        email: 'test@example.com',
        displayName: 'Test User',
      });
      targetUid = newUser.uid;
      console.log(`Created test user: ${newUser.email} (UID: ${targetUid})`);
    }
  }

  const customToken = await auth.createCustomToken(targetUid);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  const data = await res.json();
  if (data.idToken) {
    console.log('\n=================== FIREBASE ID TOKEN ===================');
    console.log(data.idToken);
    console.log('=========================================================\n');
    console.log('คัดลอก Token ด้านบนไปวางที่ช่อง firebaseIdToken ใน Postman ได้เลยครับ');
  } else {
    console.error('Error getting ID token:', data);
  }
}

main().catch(console.error);
