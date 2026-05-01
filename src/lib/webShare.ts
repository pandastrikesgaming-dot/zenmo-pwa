type ShareUrlInput = {
  text: string;
  title: string;
  url: string;
};

export async function shareUrlOrCopy(input: ShareUrlInput): Promise<'copied' | 'shared'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        text: input.text,
        title: input.title,
        url: input.url,
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  await copyText(input.url);
  return 'copied';
}

async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available in this browser.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Clipboard is not available in this browser.');
  }
}
