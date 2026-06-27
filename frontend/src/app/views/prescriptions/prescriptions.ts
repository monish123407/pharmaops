import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PrescriptionService } from '../../services/prescription.service';
import { AuthService } from '../../services/auth.service';
import { Prescription } from '../../models/types';

@Component({
  selector: 'app-prescriptions',
  standalone: true,
  templateUrl: './prescriptions.html',
  styleUrl: './prescriptions.css'
})
export class PrescriptionsComponent implements OnInit {
  private readonly prescriptionService = inject(PrescriptionService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  prescriptions = signal<Prescription[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');

  filteredPrescriptions = computed(() => {
    let list = this.prescriptions();
    const search = this.searchTerm().trim().toLowerCase();
    if (!search) return list;
    return list.filter(p => p.patientName.toLowerCase().includes(search));
  });

  ngOnInit() {
    this.loadPrescriptions();
  }

  loadPrescriptions() {
    this.loading.set(true);
    this.prescriptionService.getAll().subscribe({
      next: (data) => {
        this.prescriptions.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  dispenseAndInvoice(id: number) {
    // Navigate to sales-billing POS, automatically passing prescriptionId parameter!
    this.router.navigate(['/sales-billing'], { queryParams: { prescriptionId: id } });
  }
}
