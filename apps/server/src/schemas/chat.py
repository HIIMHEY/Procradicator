from pydantic import BaseModel

# class CreateSession(BaseModel):
# TODO: in the future for user management would require this


# i mean we will add more later
class CreateMessage(BaseModel):
    msg: str
