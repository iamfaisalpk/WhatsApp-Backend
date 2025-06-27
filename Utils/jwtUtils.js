import jwt from 'jsonwebtoken';

export const generateTokens = (userId) => {
  // Access token (short-lived)
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // 15 minutes
  );

  // Refresh token (long-lived)
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7 days
  );

  return { accessToken, refreshToken };
};
