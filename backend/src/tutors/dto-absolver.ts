import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AbsolverDto {
  @IsString()
  @IsNotEmpty({ message: 'Escriba cómo levantó la observación' })
  @MaxLength(1000, { message: 'La respuesta es demasiado larga' })
  respuesta: string;
}
