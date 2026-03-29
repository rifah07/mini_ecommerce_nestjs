import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import {
  PlaceOrderDto,
  CancelOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

//Valid status transitions
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
};

//Fraud limits
const CANCEL_LIMIT_HOURS = 24;
const CANCEL_LIMIT_COUNT = 3;
const MIN_ORDERS_FOR_RATE = 5;
const MAX_CANCEL_RATE = 0.7;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    private dataSource: DataSource,
  ) {}

  // Place Order (from cart or direct)
  async placeOrder(userId: string, dto: PlaceOrderDto) {
    return this.dataSource.transaction(async (em) => {
      let rawItems: { productId: string; quantity: number }[];

      if (dto.items?.length) {
        // Direct order
        rawItems = dto.items;
      } else {
        // From cart
        const cart = await em.findOne(Cart, {
          where: { user: { id: userId } },
          relations: ['items', 'items.product'],
        });
        if (!cart?.items?.length)
          throw new BadRequestException('Cart is empty');
        rawItems = cart.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        }));
      }

      // Validate stock and lock products
      const orderItems: OrderItem[] = [];
      let total = 0;

      for (const raw of rawItems) {
        const product = await em.findOne(Product, {
          where: { id: raw.productId },
        });
        if (!product)
          throw new NotFoundException(`Product ${raw.productId} not found`);
        if (product.stock < raw.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}"`,
          );
        }
        product.stock -= raw.quantity;
        await em.save(product);

        const item = em.create(OrderItem, {
          product,
          productName: product.name,
          quantity: raw.quantity,
          priceSnapshot: product.price,
          subtotal: Number(product.price) * raw.quantity,
        });
        orderItems.push(item);
        total += Number(item.subtotal);
      }

      const order = await em.save(
        em.create(Order, {
          user: { id: userId },
          items: orderItems,
          totalAmount: total,
          status: OrderStatus.PENDING,
        }),
      );

      // Clear cart after successful order
      const cart = await em.findOne(Cart, {
        where: { user: { id: userId } },
        relations: ['items'],
      });
      if (cart?.items?.length) await em.remove(cart.items);

      return order;
    });
  }

  // My Orders

  findMyOrders(userId: string) {
    return this.orderRepo.find({
      where: { user: { id: userId } },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findMyOrder(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, user: { id: userId } },
      relations: ['items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  //cancel Order

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.findMyOrder(userId, orderId);
    this.assertTransition(order.status, OrderStatus.CANCELLED);
    await this.assertFraudRules(userId);

    return this.dataSource.transaction(async (em) => {
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.cancellationReason = dto.reason ?? null;

      // Idempotent stock restoration
      if (!order.stockRestored) {
        for (const item of order.items) {
          if (item.product) {
            await em.increment(
              Product,
              { id: item.product.id },
              'stock',
              item.quantity,
            );
          }
        }
        order.stockRestored = true;
      }

      return em.save(order);
    });
  }

  //Admin

  findAllOrders() {
    return this.orderRepo.find({
      relations: ['user', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOrderById(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOrderById(orderId);
    this.assertTransition(order.status, dto.status);
    order.status = dto.status;
    return this.orderRepo.save(order);
  }

  //Helpers
  private assertTransition(current: OrderStatus, next: OrderStatus) {
    const allowed = TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot transition order from "${current}" to "${next}"`,
      );
    }
  }

  private async assertFraudRules(userId: string) {
    const since = new Date(Date.now() - CANCEL_LIMIT_HOURS * 60 * 60 * 1000);

    const [allOrders, recentCancels] = await Promise.all([
      this.orderRepo.find({ where: { user: { id: userId } } }),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.userId = :userId', { userId })
        .andWhere('o.status = :status', { status: OrderStatus.CANCELLED })
        .andWhere('o.cancelledAt >= :since', { since })
        .getCount(),
    ]);

    if (recentCancels >= CANCEL_LIMIT_COUNT) {
      throw new ForbiddenException(
        `You can cancel at most ${CANCEL_LIMIT_COUNT} orders within ${CANCEL_LIMIT_HOURS} hours`,
      );
    }

    if (allOrders.length >= MIN_ORDERS_FOR_RATE) {
      const totalCancelled = allOrders.filter(
        (o) => o.status === OrderStatus.CANCELLED,
      ).length;
      if (totalCancelled / allOrders.length >= MAX_CANCEL_RATE) {
        throw new ForbiddenException(
          'Cancellation rate too high. Contact support.',
        );
      }
    }
  }
}
