import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerminalSquare, Rocket, HardDrive, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

  const StatCard = ({ title, value, icon: Icon, description }: any) => (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16 mb-1" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your bots and deployments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Bots" 
          value={stats?.totalBots || 0} 
          icon={TerminalSquare} 
          description={`${stats?.runningBots || 0} currently running`}
        />
        <StatCard 
          title="Deployments" 
          value={stats?.totalDeployments || 0} 
          icon={Rocket} 
          description="Total lifetime deployments"
        />
        <StatCard 
          title="Storage Used" 
          value={stats ? `${(stats.storageUsedBytes / 1024 / 1024).toFixed(2)} MB` : "0 MB"} 
          icon={HardDrive} 
          description="Across all projects"
        />
        <StatCard 
          title="AI Requests" 
          value={stats?.aiUsageCount || 0} 
          icon={Activity} 
          description="Tokens used this month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle>Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {stats?.recentDeployments?.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recent deployments</p>
                )}
                {stats?.recentDeployments?.map((dep: any) => (
                  <div key={dep.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border/50">
                    <div>
                      <p className="font-medium text-sm">{dep.botName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(dep.startedAt).toLocaleString()}</p>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-md border ${
                      dep.status === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                      dep.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {dep.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3 font-mono text-sm">
                {stats?.recentLogs?.length === 0 && (
                  <p className="text-muted-foreground py-4 text-center font-sans">No recent logs</p>
                )}
                {stats?.recentLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`shrink-0 ${
                      log.level === 'error' ? 'text-red-400' : 
                      log.level === 'warn' ? 'text-yellow-400' : 
                      log.level === 'info' ? 'text-blue-400' : 'text-gray-400'
                    }`}>[{log.level}]</span>
                    <span className="text-gray-300 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
