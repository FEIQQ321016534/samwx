/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSplitPrice,
  calculateProxyFee,
  calculatePackagingFee,
  calculateDeliveryFee,
  calculateGroupProgress,
  calculateCheckoutTotals,
  filterOrdersByStatus,
  getOrderStatusBadge,
  CartItem,
} from './orderCalculations';

test('calculateSplitPrice computes split proportion correctly', () => {
  // Swiss rolls base price 68元, 0.5 ratio is 34元
  assert.equal(calculateSplitPrice(68, 0.5), 34);
  // 1/4 of 68 is 17
  assert.equal(calculateSplitPrice(68, 0.25), 17);
  // Full item ratio 1 is 68
  assert.equal(calculateSplitPrice(68, 1.0), 68);
});

test('calculateProxyFee clamps within min 4元 and max 25元', () => {
  // 0 subtotal = 0
  assert.equal(calculateProxyFee(0), 0);
  // 50元 * 6% = 3元 -> should clamp to min 4元
  assert.equal(calculateProxyFee(50), 4);
  // 200元 * 6% = 12元 -> within bounds
  assert.equal(calculateProxyFee(200), 12);
  // 600元 * 6% = 36元 -> should clamp to max 25元
  assert.equal(calculateProxyFee(600), 25);
});

test('calculatePackagingFee respects cold chain and free threshold', () => {
  // No cold item -> 0
  assert.equal(calculatePackagingFee(false, 100), 0);
  // Cold item under 199 -> 3元
  assert.equal(calculatePackagingFee(true, 100), 3);
  // Cold item over 199 -> free 0元
  assert.equal(calculatePackagingFee(true, 250), 0);
});

test('calculateDeliveryFee is 0 for pickup point and 8 for delivery under 299', () => {
  assert.equal(calculateDeliveryFee('pickup', 50), 0);
  assert.equal(calculateDeliveryFee('delivery', 50), 8);
  assert.equal(calculateDeliveryFee('delivery', 350), 0);
});

test('calculateGroupProgress computes percentage and remaining slots', () => {
  const result1 = calculateGroupProgress(3, 4);
  assert.equal(result1.percent, 75);
  assert.equal(result1.remaining, 1);
  assert.equal(result1.isFull, false);
  assert.equal(result1.statusLabel, '仅差1人成团');

  const result2 = calculateGroupProgress(4, 4);
  assert.equal(result2.percent, 100);
  assert.equal(result2.remaining, 0);
  assert.equal(result2.isFull, true);
  assert.equal(result2.statusLabel, '已成团');
});

test('calculateCheckoutTotals aggregates cart items, fees, and discounts accurately', () => {
  const sampleItems: CartItem[] = [
    {
      id: 'cart-1',
      productId: 'p1',
      name: '原味伯爵瑞士卷 (半盒8片)',
      originalPrice: 68,
      selectedOption: { id: 'opt-half', name: '半盒 (8片)', ratio: 0.5, slots: 2, weightEstimate: '约600g' },
      unitPrice: 34,
      quantity: 1,
      requiresColdChain: true,
      isGroupBuy: true,
    },
    {
      id: 'cart-2',
      productId: 'p2',
      name: 'Member\'s Mark 小青柠果汁 (单瓶1L)',
      originalPrice: 39.9,
      selectedOption: { id: 'opt-single', name: '单瓶装 (1L)', ratio: 0.5, slots: 2, weightEstimate: '1000ml' },
      unitPrice: 20,
      quantity: 1,
      requiresColdChain: true,
      isGroupBuy: false,
    },
  ];

  const totals = calculateCheckoutTotals(sampleItems, 'pickup', 5);
  // subtotal = 34 + 20 = 54
  assert.equal(totals.itemsSubtotal, 54);
  // proxyFee min = 4
  assert.equal(totals.proxyFee, 4);
  // packagingFee = 3
  assert.equal(totals.packagingFee, 3);
  // deliveryFee = 0 (pickup)
  assert.equal(totals.deliveryFee, 0);
  // total = 54 + 4 + 3 + 0 - 5 = 56
  assert.equal(totals.totalPayable, 56);
});

test('filterOrdersByStatus filters active and completed orders accurately', () => {
  const sampleOrders = [
    { status: 'purchasing' },
    { status: 'ready_for_pickup' },
    { status: 'completed' },
  ];
  assert.equal(filterOrdersByStatus(sampleOrders, 'all').length, 3);
  assert.equal(filterOrdersByStatus(sampleOrders, 'active').length, 2);
  assert.equal(filterOrdersByStatus(sampleOrders, 'completed').length, 1);
});

test('getOrderStatusBadge returns appropriate label for each status', () => {
  assert.equal(getOrderStatusBadge('purchasing').label, '团长采购中');
  assert.equal(getOrderStatusBadge('ready_for_pickup').label, '待自提');
  assert.equal(getOrderStatusBadge('completed').label, '已完成');
});
