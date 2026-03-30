import type { toBlob } from "html-to-image";

type Options = NonNullable<Parameters<typeof toBlob>[1]>;

export async function copyElementAsImage(element: HTMLElement, extraOptions?: Options): Promise<void> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, { quality: 1, pixelRatio: 2, ...extraOptions });

  if (!blob) {
    throw new Error("Failed to render image");
  }

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function shareElementAsImage(
  element: HTMLElement,
  fileName: string,
  extraOptions?: Options
): Promise<void> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, { quality: 1, pixelRatio: 2, ...extraOptions });

  if (!blob) {
    throw new Error("Failed to render image");
  }

  const file = new File([blob], fileName, { type: "image/png" });

  await navigator.share({ files: [file] });
}
