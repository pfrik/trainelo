import { useState } from 'react';
import { setupMyTrainingPlan } from '@/scripts/setupMyPlan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function SetupPlanPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  const handleSetupPlan = async () => {
    setIsLoading(true);
    setOutput([]);

    // Capture console logs
    const originalLog = console.log;
    const logs: string[] = [];

    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await setupMyTrainingPlan();
      setOutput(logs);
    } catch (error) {
      setOutput([...logs, `Error: ${error}`]);
    } finally {
      console.log = originalLog;
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Setup Texel 60km Training Plan</CardTitle>
          <CardDescription>
            This will create your goal and generate a 13-week training plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSetupPlan}
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up plan...
              </>
            ) : (
              'Setup My Training Plan'
            )}
          </Button>

          {output.length > 0 && (
            <Card className="mt-4 bg-gray-50">
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {output.join('\n')}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}