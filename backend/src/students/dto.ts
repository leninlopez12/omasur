import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearAlumnoDto {
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  dni: string;

  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  nombres: string;

  @IsString()
  @IsNotEmpty({ message: 'El grado es obligatorio' })
  grado: string;
}

export class CrearAlumnosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearAlumnoDto)
  alumnos: CrearAlumnoDto[];
}

export class ActualizarAlumnoDto {
  // Opcional: quien solo arregla el nombre no manda el DNI, y entonces se
  // queda el que ya tenía.
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  dni?: string;

  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  nombres: string;

  @IsString()
  @IsNotEmpty({ message: 'El grado es obligatorio' })
  grado: string;
}
