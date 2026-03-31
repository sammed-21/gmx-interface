import { t } from "@lingui/macro";
import type { toBlob } from "html-to-image";

import { helperToast } from "lib/helperToast";

type Options = NonNullable<Parameters<typeof toBlob>[1]>;

async function renderElementToBlob(element: HTMLElement, extraOptions?: Options): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, { quality: 1, pixelRatio: 2, ...extraOptions });

  if (!blob) {
    throw new Error("Failed to render image");
  }

  return blob;
}

export async function copyElementAsImage(element: HTMLElement, extraOptions?: Options): Promise<void> {
  const blob = await renderElementToBlob(element, extraOptions);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function shareElementAsImage(
  element: HTMLElement,
  fileName: string,
  extraOptions?: Options
): Promise<void> {
  const blob = await renderElementToBlob(element, extraOptions);
  const file = new File([blob], fileName, { type: "image/png" });
  await navigator.share({ files: [file] });
}

export async function shareOrCopyElementAsImage({
  element,
  isMobile,
  fileName,
  extraOptions,
}: {
  element: HTMLElement;
  isMobile: boolean;
  fileName: string;
  extraOptions?: Options;
}): Promise<void> {
  try {
    if (isMobile) {
      await shareElementAsImage(element, fileName, extraOptions);
    } else {
      await copyElementAsImage(element, extraOptions);
      helperToast.success(t`Image copied to clipboard`);
    }
  } catch {
    if (!isMobile) {
      helperToast.error(t`Failed to copy image`);
    }
  }
}
