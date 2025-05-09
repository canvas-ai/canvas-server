export async function login(email, password, userManager) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  try {
    const user = await userManager.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await userManager.validatePassword(user.id, password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    return { user };
  } catch (error) {
    // Log the error for debugging
    console.error('Login error:', error);
    throw error;
  }
}
