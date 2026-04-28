import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'O campo userId é obrigatório.' })
  userId: string;

  @IsNumber()
  @IsPositive({ message: 'O campo amount deve ser maior que zero.' })
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
