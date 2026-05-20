"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField } from "../admin/form-field";
import { ProjectsWorkspace, type ProjectRecord } from "./projects-workspace";
import { Button } from "../ui/button";
import { DialogShell } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectFormState = {
  client: string;
  title: string;
  quotationLink: string;
  status: ProjectRecord["status"];
  targetDelivery: string;
  address: string;
  notes: string;
};

const emptyProjectForm: ProjectFormState = {
  client: "",
  title: "",
  quotationLink: "",
  status: "PLANNED",
  targetDelivery: "",
  address: "",
  notes: "",
};

export function ProjectsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const projectId = searchParams.get("id") ?? "";
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const projectDialogInitialRef = useRef<string | null>(null);
  const lastActionRef = useRef("");

  const text = {
    loadFailed: "Impossible de charger les chantiers.",
    created: "cree avec succes.",
    updated: "mis a jour avec succes.",
    deleted: "supprime avec succes.",
    createFailed: "Impossible de creer le chantier.",
    updateFailed: "Impossible de modifier le chantier.",
    deleteFailed: "Impossible de supprimer le chantier.",
    loading: "Chargement des chantiers...",
    pageFailed: "La page des chantiers n'a pas pu etre chargee.",
    retry: "Reessayer",
    createTitle: "Creer un chantier",
    createDescription: "Lancez un chantier a partir d'un devis accepte ou creez-le directement pour la planification interne.",
    editTitle: "Modifier le chantier",
    editDescription: "Mettez a jour les informations du chantier, le statut et les references commerciales.",
    client: "Client",
    noClients: "Aucun client disponible",
    projectTitle: "Titre du chantier",
    status: "Statut chantier",
    quotationLink: "Lien devis",
    targetDelivery: "Livraison cible",
    chantierAddress: "Adresse du chantier",
    notes: "Notes operationnelles",
    cancel: "Annuler",
    createAction: "Creer le chantier",
    updateAction: "Enregistrer les modifications",
    deleteConfirm: "Supprimer ce chantier ? Cette action retire la fiche de la liste actuelle.",
  };

  async function loadProjects() {
    setLoading(true);
    setPageError("");

    try {
      const response = await apiClient.get<PaginatedResponse<ProjectRecord>>("/projects", {
        page: 1,
        pageSize: 100,
      });
      const clientsResponse = await apiClient.get<PaginatedResponse<ClientOption>>("/crm/clients", {
        page: 1,
        pageSize: 100,
      });
      setProjects(response.data);
      setClientOptions(clientsResponse.data.map((client) => ({ id: client.id, name: client.name })));
      setProjectForm((current) => ({
        ...current,
        client: current.client || clientsResponse.data[0]?.name || "",
      }));
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  const projectClients = useMemo(
    () => clientOptions.map((client) => client.name).sort((left, right) => left.localeCompare(right)),
    [clientOptions],
  );
  const serializedProjectDialogState = useMemo(() => JSON.stringify(projectForm), [projectForm]);
  const isProjectDialogDirty =
    (action === "new" || action === "edit") &&
    projectDialogInitialRef.current !== null &&
    projectDialogInitialRef.current !== serializedProjectDialogState;

  useEffect(() => {
    if (action === "new" && lastActionRef.current !== "new") {
      const nextForm = {
        ...emptyProjectForm,
        client: projectClients[0] ?? "",
      };
      setProjectForm(nextForm);
      setFormError("");
      setSubmitting(false);
      projectDialogInitialRef.current = JSON.stringify(nextForm);
    }

    if (action === "edit" && projectId) {
      const currentProject = projects.find((project) => project.id === projectId);
      if (currentProject) {
        const nextForm = {
          client: currentProject.client,
          title: currentProject.title,
          quotationLink: currentProject.quotation === "-" ? "" : currentProject.quotation,
          status: currentProject.status,
          targetDelivery: currentProject.delivery === "-" ? "" : currentProject.delivery,
          address: currentProject.address === "-" ? "" : currentProject.address,
          notes: currentProject.notes,
        };
        setProjectForm(nextForm);
        setFormError("");
        setSubmitting(false);
        projectDialogInitialRef.current = JSON.stringify(nextForm);
      }
    }

    if (action !== "new" && action !== "edit") {
      projectDialogInitialRef.current = null;
    }

    lastActionRef.current = action;
  }, [action, projectClients, projectId, projects]);

  function closeActionPanel() {
    router.push("/operations/projects");
    setFormError("");
    setSubmitting(false);
    setProjectForm({
      ...emptyProjectForm,
      client: projectClients[0] ?? "",
    });
    projectDialogInitialRef.current = null;
  }

  async function submitProject() {
    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        client: projectForm.client.trim(),
        title: projectForm.title.trim(),
        quotationLink: projectForm.quotationLink.trim() || null,
        status: projectForm.status,
        targetDelivery: projectForm.targetDelivery ? new Date(projectForm.targetDelivery).toISOString() : null,
        address: projectForm.address.trim(),
        notes: projectForm.notes.trim() || null,
      };

      if (action === "edit" && projectId) {
        const updated = await apiClient.patch<ProjectRecord>(`/projects/${projectId}`, payload);
        setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)));
        setFeedback(`${updated.code} ${text.updated}`);
      } else {
        const created = await apiClient.post<ProjectRecord>("/projects", payload);
        setProjects((current) => [created, ...current]);
        setFeedback(`${created.code} ${text.created}`);
      }

      setProjectForm(emptyProjectForm);
      closeActionPanel();
    } catch (error) {
      setFormError(getApiErrorMessage(error, action === "edit" ? text.updateFailed : text.createFailed));
      setSubmitting(false);
    }
  }

  async function handleDeleteProject(project: ProjectRecord) {
    if (!window.confirm(text.deleteConfirm)) {
      return;
    }

    setDeletingProjectId(project.id);
    setPageError("");

    try {
      await apiClient.del<{ success: boolean }>(`/projects/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setFeedback(`${project.code} ${text.deleted}`);
      if (action === "edit" && projectId === project.id) {
        closeActionPanel();
      }
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.deleteFailed));
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <>
      {loading ? (
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {text.loading}
        </div>
      ) : pageError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="font-medium">{text.pageFailed}</p>
          <p className="mt-2">{pageError}</p>
          <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadProjects()}>
            {text.retry}
          </Button>
        </div>
      ) : (
        <>
          <ProjectsWorkspace
            projects={projects}
            createHref="/operations/projects?action=new"
            onEditProject={(project) => router.push(`/operations/projects?action=edit&id=${project.id}`)}
            onDeleteProject={(project) => void handleDeleteProject(project)}
            deletingProjectId={deletingProjectId}
          />
          {feedback ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}
        </>
      )}

      <DialogShell
        open={action === "new" || action === "edit"}
        title={action === "edit" ? text.editTitle : text.createTitle}
        description={action === "edit" ? text.editDescription : text.createDescription}
        onClose={closeActionPanel}
        isDirty={isProjectDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.client}>
              <select
                value={projectForm.client}
                onChange={(event) => setProjectForm((current) => ({ ...current, client: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {projectClients.length ? (
                  projectClients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))
                ) : (
                  <option value="">{text.noClients}</option>
                )}
              </select>
            </FormField>
            <FormField label={text.projectTitle}>
              <Input value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} />
            </FormField>
            <FormField label={text.status}>
              <select
                value={projectForm.status}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    status: event.target.value as ProjectRecord["status"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PLANNED">Planifie</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="ON_HOLD">En attente</option>
                <option value="COMPLETED">Termine</option>
                <option value="CANCELLED">Annule</option>
              </select>
            </FormField>
            <FormField label={text.quotationLink}>
              <Input value={projectForm.quotationLink} onChange={(event) => setProjectForm((current) => ({ ...current, quotationLink: event.target.value }))} />
            </FormField>
            <FormField label={text.targetDelivery}>
              <Input type="date" value={projectForm.targetDelivery} onChange={(event) => setProjectForm((current) => ({ ...current, targetDelivery: event.target.value }))} />
            </FormField>
          </div>
          <FormField label={text.chantierAddress}>
            <Input value={projectForm.address} onChange={(event) => setProjectForm((current) => ({ ...current, address: event.target.value }))} />
          </FormField>
          <FormField label={text.notes}>
            <Textarea value={projectForm.notes} onChange={(event) => setProjectForm((current) => ({ ...current, notes: event.target.value }))} />
          </FormField>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={closeActionPanel}>
              {text.cancel}
            </Button>
            <Button type="button" className="rounded-2xl" disabled={submitting || !projectClients.length} onClick={() => void submitProject()}>
              {action === "edit" ? text.updateAction : text.createAction}
            </Button>
          </div>
        </div>
      </DialogShell>

    </>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const apiError = error as ApiError;
  return apiError.error?.details?.[0]?.message || apiError.error?.message || fallback;
}
