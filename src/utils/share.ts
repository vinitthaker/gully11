export async function shareApp(config: { title: string; text: string; url: string }): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(config);
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(`${config.text}\n${config.url}`);
    return true;
  } catch {
    return false;
  }
}
