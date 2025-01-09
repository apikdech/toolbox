export interface Item {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Person {
  id: string;
  name: string;
  items: Item[];
}

export interface DiscountSettings {
  type: "percentage" | "flat";
  value: number;
  minimumSpend: number;
  maxDiscountAmount: number;
}

export interface AdditionalFee {
  id: string;
  name: string;
  amount: number;
}

export interface BillSummary {
  personId: string;
  subtotal: number;
  discountedSubtotal: number;
  sharedFees: number;
  total: number;
}
