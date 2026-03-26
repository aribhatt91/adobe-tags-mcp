/**
 * Library State Management
 * 
 * Tracks the currently selected library for the session.
 * This is a simple in-memory state that persists across tool calls.
 */

export let currentLibraryId: string | null = null;
export let currentLibraryName: string | null = null;

export function setCurrentLibrary(libraryId: string, libraryName: string): void {
  currentLibraryId = libraryId;
  currentLibraryName = libraryName;
  //console.error(`Library selected: ${libraryName} (${libraryId})`);
}

export function clearCurrentLibrary(): void {
  currentLibraryId = null;
  currentLibraryName = null;
  //console.error('Library selection cleared');
}

export function getCurrentLibrary(): { id: string; name: string } | null {
  if (currentLibraryId && currentLibraryName) {
    return {
      id: currentLibraryId,
      name: currentLibraryName
    };
  }
  return null;
}