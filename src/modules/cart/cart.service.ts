import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { Product } from '../products/product.entity';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private itemRepo: Repository<CartItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) {}

  async getCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
    });
    if (!cart) {
      cart = await this.cartRepo.save(
        this.cartRepo.create({ user: { id: userId } }),
      );
    }
    return cart;
  }

  async addItem(userId: string, dto: AddToCartDto) {
    const cart = await this.getCart(userId);
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stock < dto.quantity)
      throw new BadRequestException('Insufficient stock');

    const existing = cart.items?.find((i) => i.product?.id === dto.productId);
    if (existing) {
      existing.quantity += dto.quantity;
      existing.priceSnapshot = product.price;
      await this.itemRepo.save(existing);
    } else {
      await this.itemRepo.save(
        this.itemRepo.create({
          cart,
          product,
          quantity: dto.quantity,
          priceSnapshot: product.price,
        }),
      );
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.getCart(userId);
    const item = cart.items?.find((i) => i.product?.id === productId);
    if (!item) throw new NotFoundException('Item not in cart');

    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product || product.stock < dto.quantity)
      throw new BadRequestException('Insufficient stock');

    item.quantity = dto.quantity;
    await this.itemRepo.save(item);
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getCart(userId);
    const item = cart.items?.find((i) => i.product?.id === productId);
    if (!item) throw new NotFoundException('Item not in cart');
    await this.itemRepo.remove(item);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    await this.itemRepo.remove(cart.items ?? []);
    return this.getCart(userId);
  }
}
