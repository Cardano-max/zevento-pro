-- Phase 7: Lead Routing Trace (audit log for routing decisions)
-- 1 new table + index on leads.created_at

-- CreateTable: lead_routing_traces
CREATE TABLE "lead_routing_traces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "score" DOUBLE PRECISION,
    "score_factors" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "skip_reason" VARCHAR(30),
    "overridden_at" TIMESTAMP(3),
    "overridden_by" UUID,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_routing_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on [lead_id, vendor_id]
CREATE UNIQUE INDEX "lead_routing_traces_lead_id_vendor_id_key" ON "lead_routing_traces"("lead_id", "vendor_id");

-- CreateIndex: index on lead_id
CREATE INDEX "lead_routing_traces_lead_id_idx" ON "lead_routing_traces"("lead_id");

-- CreateIndex: index on vendor_id
CREATE INDEX "lead_routing_traces_vendor_id_idx" ON "lead_routing_traces"("vendor_id");

-- CreateIndex: index on leads.created_at (analytics performance)
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- AddForeignKey: lead_routing_traces -> leads
ALTER TABLE "lead_routing_traces" ADD CONSTRAINT "lead_routing_traces_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lead_routing_traces -> vendor_profiles
ALTER TABLE "lead_routing_traces" ADD CONSTRAINT "lead_routing_traces_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
