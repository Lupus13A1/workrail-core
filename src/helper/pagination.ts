import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export class PaginationQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  limit = 10;
}

export class PaginatedOption {
  page: number;
  limit: number;

  constructor(page = 1, limit = 10) {
    this.page = page;
    this.limit = limit;
  }
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export async function pagination<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  options: PaginatedOption,
  isRawQuery = false,
): Promise<PaginatedResult<T>> {
  // Calculate the offset
  const offset = (options.page - 1) * options.limit;

  // Setup pagination
  queryBuilder.skip(offset).take(options.limit);

  let items: any, totalItems: number;

  if (isRawQuery) {
    // Fetch raw results and total count
    items = await queryBuilder.getRawMany();
    totalItems = await queryBuilder.getCount(); // Fetch total count separately
    items = toCamelCase(items); // Convert keys to camelCase
  } else {
    // Fetch paginated items and total count for entity-based queries
    [items, totalItems] = await queryBuilder.getManyAndCount();
  }

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / options.limit);

  // Return paginated result
  return {
    items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: options.limit,
      totalPages,
      currentPage: options.page,
    },
  };
}

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase); // Process arrays recursively
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      // Convert keys to camelCase
      const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );

      acc[camelCaseKey] = obj[key]; // Recursively process nested objects

      return acc;
    }, {} as any);
  }
  return obj; // Return primitive values as-is
}