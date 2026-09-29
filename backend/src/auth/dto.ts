import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Quita espacios y pasa a minúsculas ANTES de validar. Al copiar y pegar en el
 * celular se cuela un espacio con facilidad, y sin esto el correo se rechazaba
 * como inválido.
 */
const NormalizarCorreo = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Paso previo: crear la cuenta del tutor. Los datos de la institución van aparte. */
export class RegistroTutorDto {
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  dni: string;

  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  nombres: string;

  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  apellidos: string;

  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular: string;

  @NormalizarCorreo()
  @IsEmail({}, { message: 'Correo inválido' })
  correo: string;

  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}

/** El tutor entra con su DNI; la comisión, con su correo. */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Ingrese su DNI' })
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}

/** Paso 1 de la recuperación: solo el correo con el que se registró. */
export class SolicitarRecuperacionDto {
  @NormalizarCorreo()
  @IsEmail({}, { message: 'Escriba un correo válido' })
  correo: string;
}

/** Paso 3: el enlace recibido por correo más la nueva contraseña. */
export class RestablecerClaveDto {
  @Matches(/^[a-f0-9]{64}$/i, { message: 'El enlace no es válido' })
  token: string;

  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
