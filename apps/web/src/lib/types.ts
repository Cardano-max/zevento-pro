export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  children?: Category[];
}

export interface VendorPackage {
  id: string;
  name: string;
  description?: string;
  priceInPaise: number;
  features?: string[];
  isPopular: boolean;
}

export interface VendorService {
  id: string;
  title: string;
  description?: string;
  category?: string;
  basePrice?: number;
  priceType: 'FIXED' | 'STARTING_FROM' | 'CUSTOM_QUOTE';
  imageUrls?: string[];
  isActive: boolean;
  packages?: VendorPackage[];
}

export interface Vendor {
  id: string;
  businessName: string;
  description?: string;
  city?: string;
  role: string;
  pricingMin?: number;
  pricingMax?: number;
  stats?: { avgRating?: number; reviewCount?: number; totalBookings?: number };
  photos?: { id: string; url: string }[];
  categories?: { category: { id: string; name: string } }[];
  serviceAreas?: { market: { city: string; state: string } }[];
  user?: { name?: string; phone?: string };
  services?: VendorService[];
  blockedDates?: string[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  pricePerUnit?: number;
  pricePerDay?: number;
  stock?: number;
  vendor?: { businessName: string; city?: string };
  photos?: { url: string }[];
  category?: { name: string };
}

export interface Inquiry {
  id: string;
  status: string;
  city: string;
  eventDate?: string;
  budgetPaise?: number;
  description?: string;
  createdAt: string;
  category?: { name: string };
  assignments?: { vendor: { businessName: string }; status: string }[];
}

export interface WeddingPlanItem {
  service: string;
  emoji: string;
  percent: number;
  budgetPaise: number;
  description: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorRole: 'CUSTOMER' | 'VENDOR';
  title?: string;
  body: string;
  category: 'REQUIREMENT' | 'OFFER' | 'SHOWCASE' | 'GENERAL';
  mediaUrls?: string[];
  city?: string;
  eventDate?: string;
  budgetPaise?: number;
  status: string;
  likesCount: number;
  createdAt: string;
  author: { id: string; name?: string; phone?: string };
  comments?: FeedComment[];
  _count?: { comments: number };
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; name?: string; phone?: string };
}
