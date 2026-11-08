import { imageSize } from 'https://esm.sh/image-size@2.0.2?target=deno';
import { imageInput } from './ml-image-input.ts';

export function primarySizeDecision(width: number, height: number): 'eligible' | 'too_small' {
  return width >= 500 && height >= 500 ? 'eligible' : 'too_small';
}

/** Decode actual supplier bytes. An unavailable size is technical, never visual rejection. */
export async function checkPrimarySize(url: string): Promise<'eligible' | 'too_small' | 'unavailable'> {
  try {
    const input = await imageInput(url);
    if (!input.startsWith('data:image/')) return 'unavailable';
    const encoded = input.split(',')[1];
    if (!encoded) return 'unavailable';
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const size = imageSize(bytes);
    return primarySizeDecision(size.width, size.height);
  } catch { return 'unavailable'; }
}