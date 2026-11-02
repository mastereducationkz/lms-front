/** Props that make an element an annotatable text block of the AnnotationLayer for `scope`. */
export const annotationBlock = (scope: string, key: string) => ({
  'data-annotation-scope': scope,
  'data-annotation-block': key,
});
