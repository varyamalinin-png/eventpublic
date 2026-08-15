import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function normalizeLegacyDomain(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace('://www.iventapp.ru', '://iwent.ru')
      .replace('://iventapp.ru', '://iwent.ru');
  }

  if (Array.isArray(value)) {
    return value.map(normalizeLegacyDomain);
  }

  // Date нельзя разбирать как обычный object: иначе она превращается в {}
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = normalizeLegacyDomain(v);
    }
    return out;
  }

  return value;
}

@Injectable()
export class LegacyDomainInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => normalizeLegacyDomain(data)));
  }
}

