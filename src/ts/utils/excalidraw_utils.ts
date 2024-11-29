import {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement, ExcalidrawTextContainer,
  ExcalidrawTextElement
} from "@excalidraw/excalidraw/types/element/types";
import {MarkNonNullable} from "@excalidraw/excalidraw/types/utility-types";

export type ResolvablePromise<T> = Promise<T> & {
  resolve: [T] extends [undefined] ? (value?: T) => void : (value: T) => void;
  reject: (error: Error) => void;
};
export const resolvablePromise = <T>() => {
  let resolve!: any;
  let reject!: any;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (promise as any).resolve = resolve;
  (promise as any).reject = reject;
  return promise as ResolvablePromise<T>;
};
export const isTextBindableContainer = (
  element: ExcalidrawElement | null,
  includeLocked = true,
): element is ExcalidrawTextContainer => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === 'rectangle' ||
      element.type === 'diamond' ||
      element.type === 'ellipse' ||
      isArrowElement(element))
  );
};

export const isArrowElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawArrowElement => {
  return element != null && element.type === 'arrow';
};
export const hasBoundTextElement = (
  element: ExcalidrawElement | null,
): element is MarkNonNullable<ExcalidrawBindableElement, 'boundElements'> => {
  return (
    isTextBindableContainer(element) &&
    !!element.boundElements?.some(({ type }) => type === 'text')
  );
};
export const getBoundTextOrDefault = (
  element: ExcalidrawElement,
  elements: readonly ExcalidrawElement[] | undefined,
  defaultText: string
) => {
  if (hasBoundTextElement(element)) {
    const boundText = element.boundElements!.find(({ type }) => type === 'text');
    return elements ? (elements.find(e => e.id === boundText?.id) as ExcalidrawTextElement).text : defaultText;
  } else {
    return defaultText;
  }
};
