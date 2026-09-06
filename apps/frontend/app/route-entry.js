"use client";

import {
  AuthenticatedPage,
  BudgetView,
  CategoriesView,
  DataView,
  PlanningView,
  RegisterView,
  SettingsView,
  SimulatorView,
} from "./page";

export function RegisterEntry() {
  return <AuthenticatedPage active="register" View={RegisterView} />;
}

export function PlanningEntry() {
  return <AuthenticatedPage active="planning" View={PlanningView} />;
}

export function SimulatorEntry() {
  return <AuthenticatedPage active="simulator" View={SimulatorView} />;
}

export function BudgetEntry() {
  return <AuthenticatedPage active="budget" View={BudgetView} />;
}

export function CategoriesEntry() {
  return <AuthenticatedPage active="categories" View={CategoriesView} />;
}

export function DataEntry() {
  return <AuthenticatedPage active="data" View={DataView} />;
}

export function SettingsEntry() {
  return <AuthenticatedPage active="settings" View={SettingsView} />;
}
