import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from './order.entity';
import { Product } from '../products/product.entity';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn()
  order: Order;

  @ManyToOne(() => Product, (product) => product.orderItems, { nullable: true })
  @JoinColumn()
  product: Product | null; // Nullable — product may be deleted later

  @Column()
  productName: string; // Snapshot — preserved even if product deleted

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceSnapshot: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
