import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  PlaceOrderDto,
  CancelOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/user.entity';
import { User } from '../users/user.entity';

@ApiTags('Orders')
@ApiCookieAuth()
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Place order (from cart or direct items)' })
  place(@CurrentUser() user: User, @Body() dto: PlaceOrderDto) {
    return this.ordersService.placeOrder(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my orders' })
  myOrders(@CurrentUser() user: User) {
    return this.ordersService.findMyOrders(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get my order by ID' })
  myOrder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.findMyOrder(user.id, id);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel my order' })
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.id, id, dto);
  }

  // ─── Admin routes ─────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get all orders' })
  all() {
    return this.ordersService.findAllOrders();
  }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Get order by ID' })
  one(@Param('id') id: string) {
    return this.ordersService.findOrderById(id);
  }

  @Put('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Update order status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
