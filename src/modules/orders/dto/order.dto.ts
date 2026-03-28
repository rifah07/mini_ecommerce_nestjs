import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../order.entity';

export class OrderItemInputDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class PlaceOrderDto {
  @ApiPropertyOptional({ description: 'If omitted, order is placed from cart' })
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];
}

export class CancelOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
