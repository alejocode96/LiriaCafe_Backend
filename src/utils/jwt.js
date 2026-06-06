import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';

export const signAccessToken = (payload) => {
  return jwt.sign(
    {
      sub: payload.userId,
      rolId: payload.rolId,
      rolNombre: payload.rolNombre,
      type: 'access',
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: 'pos-system',
      audience: 'pos-client',
    }
  );
};

export const signRefreshToken = (userId) => {
  return jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: 'pos-system',
      audience: 'pos-client',
    }
  );
};

export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'pos-system',
      audience: 'pos-client',
    });

    if (decoded.type !== 'access') {
      const error = new Error('Tipo de token inválido.');
      error.name = 'InvalidTokenType';
      throw error;
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const e = new Error('La sesión ha expirado. Por favor inicia sesión nuevamente.');
      e.statusCode = 401;
      e.code = 'AUTHENTICATION_ERROR';
      throw e;
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'InvalidTokenType') {
      const e = new Error('Token inválido.');
      e.statusCode = 401;
      e.code = 'AUTHENTICATION_ERROR';
      throw e;
    }
    const e = new Error('Error al verificar el token.');
    e.statusCode = 401;
    e.code = 'AUTHENTICATION_ERROR';
    throw e;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'pos-system',
      audience: 'pos-client',
    });

    if (decoded.type !== 'refresh') {
      const e = new Error('Tipo de token inválido.');
      e.statusCode = 401;
      e.code = 'AUTHENTICATION_ERROR';
      throw e;
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const e = new Error('El refresh token ha expirado. Por favor inicia sesión.');
      e.statusCode = 401;
      e.code = 'AUTHENTICATION_ERROR';
      throw e;
    }
    const e = new Error('Refresh token inválido.');
    e.statusCode = 401;
    e.code = 'AUTHENTICATION_ERROR';
    throw e;
  }
};

export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1] ?? null;
};