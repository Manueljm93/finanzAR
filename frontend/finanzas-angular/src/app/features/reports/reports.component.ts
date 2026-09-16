import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, DropdownModule],
  template: `
    <p-card header="Reportes">
      <div class="flex gap-3 align-items-end">
        <div class="flex flex-column gap-1">
          <label>Mes</label>
          <p-dropdown [options]="months" [(ngModel)]="selectedMonth" optionLabel="label" optionValue="value"></p-dropdown>
        </div>
        <div class="flex flex-column gap-1">
          <label>Año</label>
          <p-dropdown [options]="years" [(ngModel)]="selectedYear"></p-dropdown>
        </div>
        <p-button label="Descargar PDF" icon="pi pi-download" (onClick)="downloadPdf()" [loading]="loading"></p-button>
      </div>
    </p-card>
  `
})
export class ReportsComponent {
  private http = inject(HttpClient);
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  loading = false;

  months = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(2000, i, 1).toLocaleString('es-AR', { month: 'long' }),
    value: i + 1
  }));

  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  downloadPdf() {
    this.loading = true;
    this.http.get(
      `${environment.apiUrl}/reports/monthly?year=${this.selectedYear}&month=${this.selectedMonth}`,
      { responseType: 'blob' }
    ).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resumen_${this.selectedYear}_${String(this.selectedMonth).padStart(2,'0')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }
}
