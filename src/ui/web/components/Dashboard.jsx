import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Dashboard({ user, tokens }) {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/auth/logout'}
          >
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">Email: {user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Access Tokens</span>
              <Button onClick={() => window.location.href = '/dashboard/generate-token'}>
                Generate New Token
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 border rounded-lg flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono text-sm">{token.token}</p>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(token.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => window.location.href = `/dashboard/revoke-token/${token.id}`}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
              {tokens.length === 0 && (
                <p className="text-gray-500">No access tokens generated yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;