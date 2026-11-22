import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { HsnManagementService, HsnCodeConfig } from '../../services/hsn-management.service';

interface LocalHsnRow extends HsnCodeConfig {
  draftCode: string;
  draftCgst: number;
  draftSgst: number;
  draftDescription: string;
  editing: boolean;
  saving: boolean;
}

@Component({
  selector: 'app-hsn-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './hsn-management.html',
  styleUrl: './hsn-management.css'
})
export class HsnManagementComponent implements OnInit {
  private readonly service = inject(HsnManagementService);
  private readonly snackBar = inject(MatSnackBar);

  rows = signal<LocalHsnRow[]>([]);
  loading = signal(false);
  searchQuery = signal('');

  // Add form fields state
  showAddForm = signal(false);
  newCode = signal('');
  newDescription = signal('');
  selectedNewGstLabel = signal('12% GST (CGST 6% + SGST 6%)');
  newCgst = signal(6.0);
  newSgst = signal(6.0);

  // GST slab options for the dropdown
  gstSlabs = [
    { label: '0% GST (CGST 0% + SGST 0%)',   cgst: 0,   sgst: 0   },
    { label: '5% GST (CGST 2.5% + SGST 2.5%)', cgst: 2.5, sgst: 2.5 },
    { label: '12% GST (CGST 6% + SGST 6%)',  cgst: 6,   sgst: 6   },
    { label: '18% GST (CGST 9% + SGST 9%)',  cgst: 9,   sgst: 9   },
    { label: '28% GST (CGST 14% + SGST 14%)', cgst: 14,  sgst: 14  },
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (configs) => {
        this.rows.set(configs.map(c => ({
          id: c.id,
          code: c.code,
          cgst: c.cgst,
          sgst: c.sgst,
          description: c.description ?? '',
          draftCode: c.code,
          draftCgst: c.cgst,
          draftSgst: c.sgst,
          draftDescription: c.description ?? '',
          editing: false,
          saving: false
        })));
        this.loading.set(false);
      },
      error: (err) => {
        this.snackBar.open('❌ Failed to load HSN Code directory.', 'Close', { duration: 4000 });
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  filteredRows = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.rows();
    return this.rows().filter(r =>
      r.code.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  onNewGstSlabChange(slabLabel: string) {
    const slab = this.gstSlabs.find(s => s.label === slabLabel);
    if (slab) {
      this.selectedNewGstLabel.set(slabLabel);
      this.newCgst.set(slab.cgst);
      this.newSgst.set(slab.sgst);
    }
  }

  createNewHsn() {
    const code = this.newCode().trim();
    const desc = this.newDescription().trim();

    if (!code) {
      this.snackBar.open('⚠️ HSN Code is required.', 'Close', { duration: 3000 });
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      this.snackBar.open('⚠️ HSN Code must be 4–8 digits.', 'Close', { duration: 3500 });
      return;
    }

    const payload: HsnCodeConfig = {
      code,
      cgst: this.newCgst(),
      sgst: this.newSgst(),
      description: desc
    };

    this.loading.set(true);
    this.service.create(payload).subscribe({
      next: () => {
        this.snackBar.open(`✅ HSN Code ${code} registered successfully.`, 'OK', { duration: 3000 });
        this.newCode.set('');
        this.newDescription.set('');
        this.showAddForm.set(false);
        this.load();
      },
      error: (err) => {
        this.loading.set(false);
        const errMsg = err?.error || 'Failed to register HSN Code.';
        this.snackBar.open(`❌ ${errMsg}`, 'Close', { duration: 4000 });
      }
    });
  }

  startEdit(row: LocalHsnRow) {
    this.rows.update(rows => rows.map(r => r.id === row.id
      ? { ...r, editing: true, draftCode: r.code, draftCgst: r.cgst, draftSgst: r.sgst, draftDescription: r.description ?? '' }
      : { ...r, editing: false }
    ));
  }

  cancelEdit(row: LocalHsnRow) {
    this.rows.update(rows => rows.map(r =>
      r.id === row.id ? { ...r, editing: false } : r
    ));
  }

  onEditGstSlabChange(row: LocalHsnRow, slabLabel: string) {
    const slab = this.gstSlabs.find(s => s.label === slabLabel);
    if (slab) {
      this.rows.update(rows => rows.map(r =>
        r.id === row.id ? { ...r, draftCgst: slab.cgst, draftSgst: slab.sgst } : r
      ));
    }
  }

  save(row: LocalHsnRow) {
    const code = row.draftCode.trim();
    const desc = row.draftDescription.trim();

    if (!code) {
      this.snackBar.open('⚠️ HSN Code cannot be empty.', 'Close', { duration: 3000 });
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      this.snackBar.open('⚠️ HSN Code must be 4–8 digits.', 'Close', { duration: 3500 });
      return;
    }

    this.rows.update(rows => rows.map(r => r.id === row.id ? { ...r, saving: true } : r));

    const payload: HsnCodeConfig = {
      code,
      cgst: row.draftCgst,
      sgst: row.draftSgst,
      description: desc
    };

    this.service.update(row.id!, payload).subscribe({
      next: (updated) => {
        this.snackBar.open(`✅ HSN Code ${code} updated. Tax changes cascaded to medicines and batches.`, 'OK', { duration: 5000 });
        this.load();
      },
      error: (err) => {
        this.rows.update(rows => rows.map(r => r.id === row.id ? { ...r, saving: false } : r));
        const errMsg = err?.error || 'Failed to update HSN Code.';
        this.snackBar.open(`❌ ${errMsg}`, 'Close', { duration: 4000 });
      }
    });
  }

  deleteHsn(row: LocalHsnRow) {
    if (!confirm(`Are you sure you want to delete HSN Code "${row.code}"? This will only remove it from the directory.`)) {
      return;
    }

    this.service.delete(row.id!).subscribe({
      next: () => {
        this.snackBar.open(`🗑️ HSN Code ${row.code} deleted from directory.`, 'OK', { duration: 3000 });
        this.load();
      },
      error: () => {
        this.snackBar.open('❌ Failed to delete HSN Code.', 'Close', { duration: 4000 });
      }
    });
  }

  totalGst(row: LocalHsnRow): number {
    return (row.cgst ?? 0) + (row.sgst ?? 0);
  }

  draftTotalGst(row: LocalHsnRow): number {
    return (row.draftCgst ?? 0) + (row.draftSgst ?? 0);
  }

  getSlabLabel(cgst: number, sgst: number): string {
    const slab = this.gstSlabs.find(s => s.cgst === cgst && s.sgst === sgst);
    return slab ? slab.label : `Custom (CGST ${cgst}% + SGST ${sgst}%)`;
  }
}
