import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Public release identity; it contains no configuration or account data. */
export async function GET() {
  try {
    const metadata = await readFile(path.resolve(process.cwd(), 'dist/BUILD_INFO.json'), 'utf8');
    return new Response(metadata, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Build metadata unavailable' }, { status: 503 });
  }
}
