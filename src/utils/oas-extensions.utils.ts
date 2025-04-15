/**
 * Utility functions for handling OpenAPI Specification extensions
 */
import { normalize, NormalizeOptions, OpenApiExtensionKey } from '@netcracker/qubership-apihub-api-unifier';

/**
 * Removes OAS extensions from the OpenAPI specification
 * 
 * @param specification The OpenAPI specification (as object)
 * @param allowedExtensions Array of allowed extension prefixes (with the 'x-' prefix)
 * @returns The specification with non-allowed extensions removed
 */
export const removeOASExtensions = (specification: object, allowedExtensions: string[]): object => {
  // Convert allowed extensions to OpenApiExtensionKey type
  const allowedExtensionsTyped = allowedExtensions as OpenApiExtensionKey[];
  
  // Configure options for the normalize function
  const options: NormalizeOptions = {
    resolveRef: false,
    mergeAllOf: false,
    removeOasExtensions: true,
    shouldRemoveOasExtension: (key: OpenApiExtensionKey) => !allowedExtensionsTyped.includes(key),
  };
  
  // Remove non-allowed extensions using the normalize function
  const result = normalize(specification, options);
  
  // Since normalize returns 'unknown', we need to cast it back to object
  return result as object;
};

/**
 * Checks if the given object is an OpenAPI specification
 * 
 * @param obj The object to check
 * @returns True if the object is an OpenAPI specification, false otherwise
 */
export const isOpenAPISpecification = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  // Check if the object has an 'openapi' property
  return 'openapi' in obj;
}; 