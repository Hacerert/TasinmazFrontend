// src/app/interfaces/user.interface.ts

// Kullanıcı arayüzü (interface) tanımlandı - Backend ile uyumlu
export interface User {
  id: number;
  userName: string;  // Backend'deki UserName ile uyumlu
  email?: string;    // Backend'de Email field'ı da var
  role: string;
  // Diğer kullanıcı özellikleri buraya eklenebilir.
}
