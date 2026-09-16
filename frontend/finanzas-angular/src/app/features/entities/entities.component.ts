import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmationService, MessageService } from 'primeng/api';

import { EntitiesService } from './entities.service';
import { FinancialEntity, EntityType } from './entity.model';
import {
  ENTITY_CATALOG, EntityCatalogItem, ENTITY_TYPE_LABELS, visualsFor
} from './entity-catalog';

@Component({
  selector: 'app-entities',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule, TagModule, DialogModule,
    InputTextModule, DropdownModule, ToastModule, ConfirmDialogModule,
    TooltipModule, ProgressSpinnerModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="flex flex-column gap-3">
      <div class="flex align-items-center justify-content-between">
        <h2 style="margin:0">Entidades Financieras</h2>
        <p-button label="Agregar entidad" icon="pi pi-plus" (onClick)="openAdd()" />
      </div>

      <!-- Carga inicial -->
      <div *ngIf="loading" class="flex justify-content-center p-5">
        <p-progressSpinner strokeWidth="4" [style]="{'width':'40px','height':'40px'}" />
      </div>

      <!-- Estado vacío -->
      <p-card *ngIf="!loading && entities.length === 0">
        <div class="text-center text-600 p-4">
          <i class="pi pi-building text-4xl mb-3 block text-400"></i>
          Todavía no agregaste ninguna entidad.<br />
          Usá <b>Agregar entidad</b> para elegir una del catálogo o crear la tuya.
        </div>
      </p-card>

      <!-- Grilla de entidades -->
      <div *ngIf="!loading && entities.length" class="grid">
        <div *ngFor="let e of entities" class="col-12 sm:col-6 lg:col-4">
          <p-card>
            <div class="flex align-items-center gap-3">
              <div class="ent-avatar" [style.background]="visuals(e).color">
                <i [class]="visuals(e).icon"></i>
              </div>
              <div class="flex-1">
                <div class="font-bold text-lg">{{ e.name }}</div>
                <p-tag [value]="typeLabel(e.type)" severity="info" />
              </div>
              <p-button icon="pi pi-trash" [text]="true" severity="danger"
                (onClick)="confirmRemove(e)" pTooltip="Quitar" />
            </div>
          </p-card>
        </div>
      </div>
    </div>

    <!-- Diálogo: agregar entidad -->
    <p-dialog [(visible)]="dialogVisible" header="Agregar entidad" [modal]="true"
      [style]="{'width':'460px'}" [draggable]="false">

      <!-- Acceso rápido: catálogo -->
      <ng-container *ngIf="available.length">
        <p class="text-600 mt-0 mb-2 font-medium">Del catálogo</p>
        <div class="flex flex-column gap-2 mb-4">
          <button *ngFor="let c of available" type="button" class="catalog-row"
            [disabled]="adding" (click)="add(c)">
            <div class="ent-avatar" [style.background]="c.color">
              <i [class]="c.icon"></i>
            </div>
            <div class="flex-1 text-left">
              <div class="font-bold">{{ c.name }}</div>
              <div class="text-sm text-600">{{ typeLabel(c.type) }}</div>
            </div>
            <i class="pi" [ngClass]="adding ? 'pi-spin pi-spinner' : 'pi-plus'"></i>
          </button>
        </div>
      </ng-container>

      <!-- Entidad personalizada -->
      <p class="text-600 mt-0 mb-2 font-medium">Otra entidad</p>
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label for="customName">Nombre</label>
          <input pInputText id="customName" [(ngModel)]="customName"
            placeholder="Ej: Banco Nación, Ualá, Brubank…" maxlength="200"
            (keyup.enter)="canAddCustom() && addCustom()" />
        </div>
        <div class="flex flex-column gap-1">
          <label for="customType">Tipo</label>
          <p-dropdown inputId="customType" [options]="typeOptions" [(ngModel)]="customType"
            optionLabel="label" optionValue="value" [style]="{'width':'100%'}" appendTo="body" />
        </div>

        <div class="flex justify-content-end gap-2 pt-2">
          <p-button label="Cerrar" severity="secondary" [text]="true"
            (onClick)="dialogVisible = false" type="button" />
          <p-button label="Agregar" icon="pi pi-plus" (onClick)="addCustom()"
            [loading]="adding" [disabled]="!canAddCustom()" type="button" />
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    h2 { font-size:1.5rem; }
    .ent-avatar {
      width:44px; height:44px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-size:1.2rem;
    }
    .catalog-row {
      display:flex; align-items:center; gap:1rem; width:100%;
      padding:.75rem 1rem; border:1px solid var(--surface-border); border-radius:9px;
      background:var(--surface-card); color:var(--text-color);
      cursor:pointer; transition:background .15s, border-color .15s;
    }
    .catalog-row:hover:not(:disabled) { background:var(--surface-hover); border-color:var(--primary-color); }
    .catalog-row:disabled { opacity:.6; cursor:default; }
  `]
})
export class EntitiesComponent implements OnInit {
  private entitiesSvc = inject(EntitiesService);
  private confirm = inject(ConfirmationService);
  private toast = inject(MessageService);

  entities: FinancialEntity[] = [];
  loading = false;
  adding = false;
  dialogVisible = false;

  customName = '';
  customType: EntityType = 'Bank';

  typeOptions = (Object.keys(ENTITY_TYPE_LABELS) as EntityType[])
    .map(value => ({ label: ENTITY_TYPE_LABELS[value], value }));

  /** Items del catálogo que el usuario todavía no agregó. */
  get available(): EntityCatalogItem[] {
    const used = new Set(this.entities.map(e => e.name.toLowerCase()));
    return ENTITY_CATALOG.filter(c => !used.has(c.name.toLowerCase()));
  }

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading = true;
    this.entitiesSvc.list().subscribe({
      next: data => { this.entities = data; this.loading = false; },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las entidades.' });
        this.loading = false;
      }
    });
  }

  openAdd() {
    this.customName = '';
    this.customType = 'Bank';
    this.dialogVisible = true;
  }

  /** Alta desde el catálogo (acceso rápido). */
  add(item: EntityCatalogItem) {
    this.createEntity(item.name, item.type);
  }

  canAddCustom(): boolean {
    const name = this.customName.trim();
    return name.length > 0 && !this.nameExists(name);
  }

  /** Alta de una entidad personalizada con nombre libre. */
  addCustom() {
    const name = this.customName.trim();
    if (!name) return;
    if (this.nameExists(name)) {
      this.toast.add({ severity: 'warn', summary: 'Duplicada', detail: `Ya existe una entidad "${name}".` });
      return;
    }
    this.createEntity(name, this.customType, () => { this.customName = ''; });
  }

  private createEntity(name: string, type: EntityType, onSuccess?: () => void) {
    this.adding = true;
    this.entitiesSvc.create({ name, type }).subscribe({
      next: created => {
        this.entities = [...this.entities, created].sort((a, b) => a.name.localeCompare(b.name));
        this.adding = false;
        this.toast.add({ severity: 'success', summary: 'Agregada', detail: `${name} agregada.` });
        onSuccess?.();
      },
      error: () => {
        this.adding = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo agregar la entidad.' });
      }
    });
  }

  private nameExists(name: string): boolean {
    return this.entities.some(e => e.name.toLowerCase() === name.toLowerCase());
  }

  confirmRemove(entity: FinancialEntity) {
    this.confirm.confirm({
      message: `¿Quitar "${entity.name}"? Los ingresos asociados quedarán sin entidad.`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.entitiesSvc.delete(entity.id).subscribe({
          next: () => {
            this.entities = this.entities.filter(e => e.id !== entity.id);
            this.toast.add({ severity: 'success', summary: 'Quitada', detail: `${entity.name} eliminada.` });
          },
          error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar la entidad.' })
        });
      }
    });
  }

  visuals(e: FinancialEntity) {
    return visualsFor(e.name, e.type);
  }

  typeLabel(type: EntityType): string {
    return ENTITY_TYPE_LABELS[type];
  }
}
