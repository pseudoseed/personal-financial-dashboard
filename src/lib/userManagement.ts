import { prisma } from './db';

/**
 * Always return the default user ID, creating the user if missing.
 */
export async function getCurrentUserId(): Promise<string> {
  try {
    // Force return 'default' since that's where all accounts are stored
    return 'default';
  } catch (error) {
    console.error('Error getting current user ID:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to get current user ID');
  }
}

/**
 * Get the current user object from the database.
 * 
 * @returns Promise<User> - The current user object
 */
export async function getCurrentUser() {
  return prisma.user.findUnique({ where: { id: 'default' } });
}

/**
 * Ensure the default user exists in the database.
 * This is useful for initialization and testing.
 * 
 * @returns Promise<string> - The default user's database ID
 */
export async function ensureDefaultUser(): Promise<string> {
  return getCurrentUserId();
} 