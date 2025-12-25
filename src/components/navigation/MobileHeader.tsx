import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 border-b border-border bg-background md:hidden">
      <h1 className="text-lg font-semibold text-foreground">Trainelo</h1>
      <Link to="/settings">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </Link>
    </header>
  );
}
