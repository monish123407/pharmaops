import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Form Signals
  username = signal<string>('');
  password = signal<string>('');
  
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  onSubmit(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    
    this.error.set(null);
    this.loading.set(true);

    this.auth.login({
      username: this.username(),
      password: this.password()
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error || 'Authentication failed. Please verify credentials.');
      }
    });
  }

  quickLogin(user: string, pass: string) {
    this.username.set(user);
    this.password.set(pass);
    // Trigger login instantly for seamless testing!
    this.onSubmit();
  }

  focusPassword(event: Event) {
    event.preventDefault();
    const el = document.getElementById('password-input');
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  }

  focusUsername(event: Event) {
    event.preventDefault();
    const el = document.getElementById('username-input');
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  }
}
