import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Modalidad, NivelInstitucion } from '@prisma/client';

/** Paso 1 del asistente: institución educativa del tutor. */
export class DatosInstitucionDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la institución es obligatorio' })
  institucion: string;

  @IsEnum(Modalidad, { message: 'Seleccione la modalidad' })
  modalidad: Modalidad;

  @IsEnum(NivelInstitucion, { message: 'Seleccione el nivel' })
  nivelInstitucion: NivelInstitucion;

  @IsString()
  @IsNotEmpty({ message: 'Seleccione el departamento' })
  departamento: string;

  @IsString()
  @IsNotEmpty({ message: 'Seleccione la provincia' })
  provincia: string;

  @IsString()
  @IsNotEmpty({ message: 'Seleccione el distrito' })
  distrito: string;

  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;
}
