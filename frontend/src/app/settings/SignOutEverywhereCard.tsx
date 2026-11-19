import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useSignOutEverywhere } from '@/lib/auth'

export default function SignOutEverywhereCard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const signOutEverywhere = useSignOutEverywhere()

  const handleConfirm = async () => {
    try {
      await signOutEverywhere.mutateAsync()
      setIsDialogOpen(false)
    } catch {
      toast.error('Failed to log out everywhere. Please try again.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          Log out of every browser and device you are signed in on, including
          this one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Log out everywhere</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Log out everywhere
              </DialogTitle>
            </DialogHeader>
            <DialogDescription>
              This ends your sessions on all devices, including this one. Other
              devices may stay signed in for up to 15 minutes.
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button className="mr-2">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                isLoading={signOutEverywhere.isPending}
              >
                Log out everywhere
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
