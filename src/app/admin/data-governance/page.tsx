'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Activity, AlertTriangle } from 'lucide-react';

interface DataGovernanceStatus {
  status: string;
  timestamp: string;
  queues: {
    eventIngestion: { waiting: number; active: number; completed: number; failed: number };
    studentSnapshot: { waiting: number; active: number; completed: number; failed: number };
    classSnapshot: { waiting: number; active: number; completed: number; failed: number };
  };
  data: {
    studentSnapshots: number;
    classSnapshots: number;
    learningFacts: number;
    activeRiskFlags: number;
    bufferedEvents: number;
  };
  freshness: {
    lastSnapshotMinutes: number | null;
    status: string;
  };
  recentSnapshots: Array<{
    userId: string;
    snapshotAt: string;
    factCount: number;
  }>;
}

export default function DataGovernanceDashboard() {
  const [status, setStatus] = useState<DataGovernanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/data-governance/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span>Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Governance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Last updated: {new Date(status.timestamp).toLocaleString()}
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-2 rounded-lg hover:bg-secondary"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={status.status === 'healthy' ? 'default' : 'destructive'}
              className="text-lg"
            >
              {status.status === 'healthy' ? '🟢 Healthy' : '🔴 Error'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Freshness</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status.freshness.lastSnapshotMinutes !== null
                ? `${status.freshness.lastSnapshotMinutes}m ago`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status.freshness.status === 'fresh' ? '✓ Fresh' : '⚠ Stale'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Learning Facts</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status.data.learningFacts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total facts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Risk Flags</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.data.activeRiskFlags}</div>
            <p className="text-xs text-muted-foreground">Unresolved risks</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(status.queues).map(([name, stats]) => (
              <div key={name} className="border rounded-lg p-4">
                <h3 className="font-semibold capitalize mb-2">{name.replace(/([A-Z])/g, ' $1').trim()}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Waiting: <span className="font-mono">{stats.waiting}</span></div>
                  <div>Active: <span className="font-mono">{stats.active}</span></div>
                  <div>Completed: <span className="font-mono">{stats.completed}</span></div>
                  <div>Failed: <span className="font-mono text-red-500">{stats.failed}</span></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Snapshot Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Student Snapshots</h4>
              <p className="text-3xl font-bold">{status.data.studentSnapshots.toLocaleString()}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Class Snapshots</h4>
              <p className="text-3xl font-bold">{status.data.classSnapshots.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {status.recentSnapshots.map((snapshot, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <span className="font-mono text-sm">{snapshot.userId.slice(0, 8)}...</span>
                  <span className="text-muted-foreground ml-2">
                    {snapshot.factCount} facts
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(snapshot.snapshotAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
