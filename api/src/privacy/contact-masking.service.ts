import { Injectable } from '@nestjs/common';

@Injectable()
export class ContactMaskingService {
  maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '****';
    return '****' + phone.slice(-4);
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const prefix = local.length >= 2 ? local.slice(0, 2) : local;
    return `${prefix}****@${domain}`;
  }

  maskUserData(userData: any, fieldsToMask: string[]): any {
    if (!userData || typeof userData !== 'object') return userData;

    const cloned = Array.isArray(userData)
      ? userData.map((item) => this.maskUserData(item, fieldsToMask))
      : { ...userData };

    if (Array.isArray(cloned)) return cloned;

    for (const key of Object.keys(cloned)) {
      if (fieldsToMask.includes(key)) {
        if (key === 'phone' && typeof cloned[key] === 'string') {
          cloned[key] = this.maskPhone(cloned[key]);
        } else if (key === 'email' && typeof cloned[key] === 'string') {
          cloned[key] = this.maskEmail(cloned[key]);
        } else {
          cloned[key] = '****';
        }
      } else if (cloned[key] && typeof cloned[key] === 'object') {
        cloned[key] = this.maskUserData(cloned[key], fieldsToMask);
      }
    }

    return cloned;
  }

  shouldMaskForRole(viewerRole: string, dataOwnerRole: string): boolean {
    // ADMIN sees everything unmasked
    if (viewerRole === 'ADMIN') return false;

    // CUSTOMER data is masked for PLANNER and SUPPLIER roles
    if (
      dataOwnerRole === 'CUSTOMER' &&
      (viewerRole === 'PLANNER' || viewerRole === 'SUPPLIER')
    ) {
      return true;
    }

    // PLANNER/SUPPLIER data visible to ADMIN only (already handled above)
    if (
      (dataOwnerRole === 'PLANNER' || dataOwnerRole === 'SUPPLIER') &&
      viewerRole !== 'ADMIN'
    ) {
      return true;
    }

    return false;
  }
}
