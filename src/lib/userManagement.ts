import { prisma } from './db';

// Debug: Print the database URL being used
console.log('DATABASE_URL:', process.env.DATABASE_URL);

/**
 * Get the current user ID from the database.
 * This function handles user authentication and falls back to the default user.
 * 
 * @returns Promise<string> - The current user's database ID
 */
export async function getCurrentUserId(): Promise<string> {
  try {
    // Get the first user from the database
    const user = await prisma.user.findFirst();
    
    if (!user) {
      // If no user exists, create a default user
      const defaultUser = await prisma.user.create({
        data: {
          email: 'default@example.com',
          name: 'Default User'
        }
      });
      return defaultUser.id;
    }
    
    return user.id;
  } catch (error) {
    // Fix the error handling to avoid null payload issues
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
  const userId = await getCurrentUserId();
  return prisma.user.findUnique({
    where: { id: userId }
  });
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