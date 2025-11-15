"use client";

import { TeamMember } from "@/app/actions/team";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import Image from "next/image";
import { GithubIcon } from "@/components/icons";
import CoreLogo from "@/components/CoreLogo";

export default function TeamUserTable({ members }: { members: TeamMember[] }) {
  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <GithubIcon size={16} className="text-black dark:text-white" />
                <span>GitHub</span>
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Image src="/42-logo.svg" alt="42" width={16} height={16} />
                <span>Intra</span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground"
              >
                No team members found
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage
                        src={member.profilePicture}
                        alt={member.name}
                      />
                      <AvatarFallback>
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {member.isEventAdmin && (
                      <Tooltip>
                        <TooltipTrigger>
                          <CoreLogo
                            fill="#E66100"
                            width={30}
                            height={30}
                            className="rounded-full"
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Admin</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span>{member.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`https://github.com/${member.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-inherit hover:underline"
                  >
                    {member.username}
                  </Link>
                </TableCell>
                <TableCell>
                  {member.intraUsername ? (
                    <Link
                      href={`https://profile.intra.42.fr/users/${member.intraUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-inherit hover:underline"
                    >
                      {member.intraUsername}
                    </Link>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
