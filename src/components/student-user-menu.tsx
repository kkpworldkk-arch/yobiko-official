"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/actions/auth";

export function StudentUserMenu({
  name,
  initials,
}: {
  name: string;
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none">
        <span className="hidden text-body-sm text-ivory-200 sm:inline">
          {name} 様
        </span>
        <Avatar className="size-9 border border-white/[0.06] transition-colors duration-300 hover:border-gold-500/30">
          <AvatarFallback className="bg-navy-600 text-body-sm text-gold-400">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => {
            void logout();
          }}
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
