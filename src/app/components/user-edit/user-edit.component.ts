// src/app/components/user-edit/user-edit.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User } from '../../interfaces/user.interface'; // Merkezi User arayüzünü import ediyoruz!

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.css']
})
export class UserEditComponent implements OnInit {
  userForm: FormGroup;
  userId: number | null = null;
  isNewUser: boolean = false;
  error: string | null = null;
  successMessage: string | null = null;
  loading: boolean = true;
  roles: string[] = ['Admin', 'User'];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private authService: AuthService
  ) {
    this.userForm = this.fb.group({
      id: [null],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]], // Email alanı formda kalmaya devam ediyor
      role: ['User', Validators.required],
      password: ['', Validators.minLength(6)],
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.userId = +idParam;
        this.isNewUser = false;
        this.loadUser(this.userId);
        this.userForm.get('password')?.clearValidators();
        this.userForm.get('password')?.updateValueAndValidity();
      } else {
        this.isNewUser = true;
        this.loading = false;
        this.userForm.get('password')?.setValidators(Validators.required);
        this.userForm.get('password')?.updateValueAndValidity();
      }
    });

    this.authService.userRole$.subscribe(role => {
      if (role !== 'Admin') {
        alert('Bu sayfaya erişim yetkiniz yok. Yönetici olmalısınız.');
        this.router.navigate(['/tasinmazlar']);
      }
    });
  }

  loadUser(id: number): void {
    this.loading = true;
    this.error = null;
    this.userService.getUserById(id).subscribe({
      next: (user: User) => {
        this.userForm.patchValue({
          id: user.id,
          username: user.userName,  // Backend'deki UserName ile uyumlu
          email: user.email || '', // Backend'de email field'ı da var
          role: user.role
        });
        this.loading = false;
      },
      error: (err) => {
        console.error('Kullanıcı yüklenirken hata oluştu:', err);
        this.error = 'Kullanıcı yüklenirken bir hata oluştu: ' + (err.error?.message || err.message);
        this.loading = false;
        if (err.status === 401 || err.status === 403) {
          this.authService.logout();
          this.router.navigate(['/login']);
        } else if (err.status === 404) {
          this.error = 'Kullanıcı bulunamadı.';
        }
      }
    });
  }

  onSubmit(): void {
    // Önceki mesajları temizle
    this.error = null;
    this.successMessage = null;
    
    if (this.userForm.invalid) {
      this.error = 'Lütfen tüm alanları doğru şekilde doldurun.';
      this.userForm.markAllAsTouched();
      
      // 5 saniye sonra error message'ı temizle
      setTimeout(() => {
        this.error = null;
      }, 5000);
      return;
    }

    this.loading = true;

    const userData = this.userForm.value;

    if (this.isNewUser) {
      this.authService.register(userData).subscribe({
        next: (response) => {
          this.successMessage = 'Kullanıcı başarıyla eklendi!';
          this.loading = false;
          
          // 2 saniye sonra yönlendir
          setTimeout(() => {
            this.router.navigate(['/admin-dashboard']);
          }, 2000);
        },
        error: (err) => {
          console.error('Kullanıcı eklenirken hata oluştu:', err);
          this.error = 'Kullanıcı eklenirken bir hata oluştu: ' + (err.error?.message || err.message);
          this.loading = false;
          
          // 5 saniye sonra error message'ı temizle
          setTimeout(() => {
            this.error = null;
          }, 5000);
        }
      });
    } else {
      this.userService.updateUser(this.userId!, userData).subscribe({
        next: () => {
          this.successMessage = 'Kullanıcı başarıyla güncellendi!';
          this.loading = false;
          
          // 2 saniye sonra yönlendir
          setTimeout(() => {
            this.router.navigate(['/admin-dashboard']);
          }, 2000);
        },
        error: (err) => {
          console.error('Kullanıcı güncellenirken hata oluştu:', err);
          this.error = 'Kullanıcı güncellenirken bir hata oluştu: ' + (err.error?.message || err.message);
          this.loading = false;
          
          // 5 saniye sonra error message'ı temizle
          setTimeout(() => {
            this.error = null;
          }, 5000);
          
          if (err.status === 401 || err.status === 403) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }
}
