-- CreateSchema

-- CreateTable
CREATE TABLE "wf_workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "nodes" TEXT NOT NULL DEFAULT '[]',
    "edges" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '[]',
    "documents" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_paths" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeIds" TEXT NOT NULL DEFAULT '[]',
    "edgeIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_roles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_role_groups" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_role_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_locations" (
    "id" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_bins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToRoleGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToRoleGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RoleToRoleGroup_B_index" ON "_RoleToRoleGroup"("B");

-- AddForeignKey
ALTER TABLE "wf_paths" ADD CONSTRAINT "wf_paths_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "wf_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_bins" ADD CONSTRAINT "wf_bins_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "wf_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToRoleGroup" ADD CONSTRAINT "_RoleToRoleGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "wf_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToRoleGroup" ADD CONSTRAINT "_RoleToRoleGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "wf_role_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

