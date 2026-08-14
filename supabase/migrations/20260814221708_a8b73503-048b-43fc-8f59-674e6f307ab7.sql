CREATE OR REPLACE FUNCTION public.prevent_message_content_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.sender_user_id IS DISTINCT FROM auth.uid() THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.proposed_value IS DISTINCT FROM OLD.proposed_value
       OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
       OR NEW.sender_email IS DISTINCT FROM OLD.sender_email
       OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    THEN
      RAISE EXCEPTION 'Only the sender can modify message content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_prevent_content_tampering ON public.messages;
CREATE TRIGGER messages_prevent_content_tampering
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_message_content_tampering();

REVOKE EXECUTE ON FUNCTION public.prevent_message_content_tampering() FROM anon, authenticated;